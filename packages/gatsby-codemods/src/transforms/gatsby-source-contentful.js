import * as graphql from "graphql"
import { parse, print } from "recast"
import { transformFromAstSync, parseSync } from "@babel/core"
import { cloneDeep } from "lodash"

export default function jsCodeShift(file) {
  if (
    file.path.includes(`node_modules`) ||
    file.path.includes(`.cache`) ||
    file.path.includes(`public`)
  ) {
    return file.source
  }
  const transformedSource = babelRecast(file.source, file.path)
  return transformedSource
}

export function babelRecast(code, filePath) {
  const transformedAst = parse(code, {
    parser: {
      parse: source => runParseSync(source, filePath),
    },
  })

  const changedTracker = { hasChanged: false, filename: filePath } // recast adds extra semicolons that mess with diffs and we want to avoid them

  const options = {
    cloneInputAst: false,
    code: false,
    ast: true,
    plugins: [[updateImport, changedTracker]],
  }

  const { ast } = transformFromAstSync(transformedAst, code, options)

  if (changedTracker.hasChanged) {
    return print(ast, { lineTerminator: `\n` }).code
  }
  return code
}

const CONTENT_TYPE_SELECTOR_REGEX = /^(allContentful|contentful)([A-Z0-9].+)/
const CONTENT_TYPE_SELECTOR_BLACKLIST = [`Asset`, `Reference`, `Id`]
const SYS_FIELDS_TRANSFORMS = new Map([
  [`node_locale`, `locale`],
  [`contentful_id`, `id`],
  [`spaceId`, `spaceId`],
  [`createdAt`, `firstPublishedAt`],
  [`updatedAt`, `publishedAt`],
  [`revision`, `publishedVersion`],
])
const ASSET_FLAT_PROPERTIES = [
  `url`,
  `fileName`,
  `contentType`,
  `size`,
  `width`,
  `height`,
]

const isContentTypeSelector = selector => {
  if (!selector) {
    return false
  }
  const res = selector.match(CONTENT_TYPE_SELECTOR_REGEX)
  return res && !CONTENT_TYPE_SELECTOR_BLACKLIST.includes(res[2])
}
const updateContentfulSelector = selector =>
  selector.replace(`ontentful`, `ontentfulContentType`)

const renderFilename = (path, state) =>
  `${state.opts.filename} (Line ${path.node.loc.start.line})`

const injectNewFields = (selections, newFields, fieldToReplace) => {
  if (!fieldToReplace) {
    return [...selections, ...newFields]
  }

  const fieldIndex = selections.findIndex(
    ({ name }) => name?.value === fieldToReplace
  )

  return [
    ...selections.slice(0, fieldIndex),
    ...newFields,
    ...selections.slice(fieldIndex + 1),
  ]
}

export function updateImport(babel) {
  const { types: t, template } = babel
  return {
    visitor: {
      Identifier(path, state) {
        if (path.node.name === `contentful_id`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change "contentful_id" -> "sys.id"`
          )
        }
        if (path.node.name === `node_locale`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change "node_locale" -> "sys.locale"`
          )
        }
        if (path.node.name === `type`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change "type" -> "sys.contentType.name"`
          )
        }
        if (path.node.name === `contentType`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change flatten the Contentful Asset structure: "file.contentType" -> "contentType"`
          )
        }
      },
      ObjectPattern(path, state) {
        // rename sys.type to sys.contentType
        path.node.properties.forEach(property => {
          if (property.key?.name === `sys`) {
            property.value.properties.forEach(sysProperty => {
              if (sysProperty.key?.name === `type`) {
                sysProperty.key.name = `contentType`
              }
            })
          }
        })

        // renamed & moved sys properties
        const transformedSysProperties = []
        path.node.properties.forEach(property => {
          if (SYS_FIELDS_TRANSFORMS.has(property.key?.name)) {
            transformedSysProperties.push({
              ...property,
              key: {
                ...property.key,
                name: SYS_FIELDS_TRANSFORMS.get(property.key.name),
              },
            })
          }
        })

        if (transformedSysProperties.length) {
          const sysField = {
            type: `Property`,
            key: {
              type: `Identifier`,
              name: `sys`,
            },
            value: {
              type: `ObjectPattern`,
              properties: transformedSysProperties,
            },
          }

          path.node.properties = injectSysField(sysField, path.node.properties)

          state.opts.hasChanged = true
        }
      },
      MemberExpression(path, state) {
        if (isContentTypeSelector(path.node.property?.name)) {
          if (
            path.node.object?.name === `data` ||
            path.node.object.property?.name === `data`
          ) {
            path.node.property.name = updateContentfulSelector(
              path.node.property.name
            )
            state.opts.hasChanged = true
          } else {
            console.log(
              `${renderFilename(path, state)}: You might need to change "${
                path.node.property?.name
              }" -> "${updateContentfulSelector(path.node.property.name)}"`
            )
          }
        }
        if (path.node.property?.name === `contentful_id`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change "contentful_id" -> "sys.id"`
          )
        }

        if (path.node.property?.name === `file`) {
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change flatten the Contentful Asset structure: "file.details.image.width" -> "width"`
          )
        }

        if (path.node.property?.name === `metadata`) {
          if (path.node.object.property.name === `node`) {
            path.node.property.name = `contentfulMetadata`
            state.opts.hasChanged = true
            return
          }
          console.log(
            `${renderFilename(
              path,
              state
            )}: You might need to change your data selectors: "metadata" -> "contentfulMetadata"`
          )
        }
      },
      TaggedTemplateExpression({ node }, state) {
        if (node.tag.name !== `graphql`) {
          return
        }
        const query = node.quasi?.quasis?.[0]?.value?.raw
        if (query) {
          const { ast: transformedGraphQLQuery, hasChanged } =
            processGraphQLQuery(query, state)

          if (hasChanged) {
            node.quasi.quasis[0].value.raw = graphql.print(
              transformedGraphQLQuery
            )
            state.opts.hasChanged = true
          }
        }
      },
      CallExpression({ node }, state) {
        if (node.callee.name !== `graphql`) {
          return
        }
        const query = node.arguments?.[0].quasis?.[0]?.value?.raw

        if (query) {
          const { ast: transformedGraphQLQuery, hasChanged } =
            processGraphQLQuery(query, state)

          if (hasChanged) {
            node.arguments[0].quasis[0].value.raw = graphql.print(
              transformedGraphQLQuery
            )
            state.opts.hasChanged = true
          }
        }
      },
    },
  }
}

// Locate a subfield within a selection set or fields
function locateSubfield(node, fieldName) {
  const subFields = node.selectionSet?.selections || node.value?.fields
  if (!subFields) {
    return null
  }
  return subFields.find(({ name }) => name?.value === fieldName)
}

// Replace first old field occurence with new sys field
const injectSysField = (sysField, selections) => {
  let sysInjected = false
  return selections
    .map(field => {
      const fieldName = field.name?.value || field.key?.name
      if (SYS_FIELDS_TRANSFORMS.has(fieldName)) {
        if (!sysInjected) {
          // Inject for first occurence of a sys field
          sysInjected = true
          return sysField
        }
        // Remove all later fields
        return null
      }
      // Keep non-sys fields as they are
      return field
    })
    .filter(Boolean)
}

// Flatten the old deeply nested Contentful asset structure
const flattenAssetFields = node => {
  const flatAssetFields = []
  // Flatten asset file field
  const fileField = locateSubfield(node, `file`)
  if (fileField) {
    // Top level file fields
    const urlField = locateSubfield(fileField, `url`)
    if (urlField) {
      flatAssetFields.push(urlField)
    }
    const fileNameField = locateSubfield(fileField, `fileName`)
    if (fileNameField) {
      flatAssetFields.push(fileNameField)
    }
    const contentTypeField = locateSubfield(fileField, `contentType`)
    if (contentTypeField) {
      flatAssetFields.push(contentTypeField)
    }

    // details subfield with size and dimensions
    const detailsField = locateSubfield(fileField, `details`)
    if (detailsField) {
      const sizeField = locateSubfield(detailsField, `size`)
      if (sizeField) {
        flatAssetFields.push(sizeField)
      }
      // width & height from image subfield
      const imageField = locateSubfield(detailsField, `image`)
      if (imageField) {
        const widthField = locateSubfield(imageField, `width`)
        if (widthField) {
          flatAssetFields.push(widthField)
        }
        const heightField = locateSubfield(imageField, `height`)
        if (heightField) {
          flatAssetFields.push(heightField)
        }
      }
    }
  }
  return flatAssetFields
}

function processGraphQLQuery(query, state) {
  try {
    let hasChanged = false // this is sort of a hack, but print changes formatting and we only want to use it when we have to
    const ast = graphql.parse(query)

    graphql.visit(ast, {
      Argument(node) {
        // Filtering
        if (node.name.value === `filter`) {
          // flatten Contentful Asset filters
          const flatAssetFields = flattenAssetFields(node)
          if (flatAssetFields.length) {
            node.value.fields = injectNewFields(
              node.value.fields,
              flatAssetFields,
              `file`
            )
            hasChanged = true
          }

          // Rename sys.type to sys.contentType
          node.value.fields.forEach(field => {
            if (field.name?.value === `sys`) {
              const typeField = locateSubfield(field, `type`)
              if (typeField) {
                typeField.name.value = `contentType`
                typeField.value = {
                  kind: `ObjectValue`,
                  fields: [
                    {
                      kind: `ObjectField`,
                      name: {
                        kind: `Name`,
                        value: `name`,
                      },
                      value: typeField.value,
                    },
                  ],
                }
                hasChanged = true
              }
            }
          })

          // Move sys attributes into real sys
          const contentfulSysFields = node.value.fields.filter(({ name }) =>
            SYS_FIELDS_TRANSFORMS.has(name?.value)
          )

          if (contentfulSysFields.length) {
            const transformedSysFields = cloneDeep(contentfulSysFields).map(
              field => {
                field.name.value = SYS_FIELDS_TRANSFORMS.get(field.name.value)
                return field
              }
            )

            const sysField = {
              kind: `ObjectField`,
              name: {
                kind: `Name`,
                value: `sys`,
              },
              value: {
                kind: `ObjectValue`,
                fields: transformedSysFields,
              },
            }

            // Inject the new sys at the first occurence of any old sys field
            node.value.fields = injectSysField(sysField, node.value.fields)

            hasChanged = true
            return
          }
        }
        // Sorting
        if (node.name.value === `sort`) {
          node.value.fields.forEach(sortField => {
            // New sys structure
            if (SYS_FIELDS_TRANSFORMS.has(sortField.value.value)) {
              sortField.value.value = `sys___${SYS_FIELDS_TRANSFORMS.get(
                sortField.value.value
              )}`
              hasChanged = true
            }
            if (sortField.value.value === `sys___type`) {
              sortField.value.value = `sys___contentType`
              hasChanged = true
            }
            // Flatten asset sort
            if (sortField.value.value.indexOf(`file___`) !== -1) {
              const flatSearchProperty = ASSET_FLAT_PROPERTIES.find(
                propName => sortField.value.value.indexOf(propName) !== -1
              )
              if (flatSearchProperty) {
                sortField.value.value = flatSearchProperty
                hasChanged = true
              }
            }
          })
        }
      },
      SelectionSet(node, index, parent) {
        // Rename content type node selectors
        node.selections.forEach(field => {
          if (isContentTypeSelector(field.name?.value)) {
            field.name.value = updateContentfulSelector(field.name.value)
            hasChanged = true
          }
        })

        // Rename metadata to contentfulMetadata node selectors
        node.selections.forEach(field => {
          if (field.name?.value === `metadata`) {
            field.name.value = `contentfulMetadata`
            hasChanged = true
          }
        })

        // Rename sys.type to sys.contentType
        node.selections.forEach(field => {
          if (field.name?.value === `sys`) {
            const typeField = locateSubfield(field, `type`)
            if (typeField) {
              typeField.name.value = `contentType`
              hasChanged = true
            }
          }
        })

        // Move sys attributes into real sys
        const contentfulSysFields = node.selections.filter(({ name }) =>
          SYS_FIELDS_TRANSFORMS.has(name?.value)
        )

        if (contentfulSysFields.length && parent.name.value !== `sys`) {
          const transformedSysFields = cloneDeep(contentfulSysFields).map(
            field => {
              field.name.value = SYS_FIELDS_TRANSFORMS.get(field.name.value)
              return field
            }
          )

          const sysField = {
            kind: `Field`,
            name: {
              kind: `Name`,
              value: `sys`,
            },
            selectionSet: {
              kind: `SelectionSet`,
              selections: transformedSysFields,
            },
          }

          // Inject the new sys at the first occurence of any old sys field
          node.selections = injectSysField(sysField, node.selections)

          hasChanged = true
          return
        }

        // @todo text field: field.field -> field.raw

        // @todo rich text
      },
      Field(node, index) {
        // Flatten asset file field
        const flatAssetFields = flattenAssetFields(node)

        if (flatAssetFields.length) {
          node.selectionSet.selections = injectNewFields(
            node.selectionSet.selections,
            flatAssetFields,
            `file`
          )

          hasChanged = true
        }
      },
    })
    return { ast, hasChanged }
  } catch (err) {
    throw new Error(
      `GatsbySourceContentfulCodemod: GraphQL syntax error in query:\n\n${query}\n\nmessage:\n\n${err}`
    )
  }
}

function runParseSync(source, filePath) {
  let ast
  try {
    ast = parseSync(source, {
      plugins: [
        `@babel/plugin-syntax-jsx`,
        `@babel/plugin-proposal-class-properties`,
      ],
      overrides: [
        {
          test: [`**/*.ts`, `**/*.tsx`],
          plugins: [[`@babel/plugin-syntax-typescript`, { isTSX: true }]],
        },
      ],
      filename: filePath,
      parserOpts: {
        tokens: true, // recast uses this
      },
    })
  } catch (e) {
    console.error(e)
  }
  if (!ast) {
    console.log(
      `The codemod was unable to parse ${filePath}. If you're running against the '/src' directory and your project has a custom babel config, try running from the root of the project so the codemod can pick it up.`
    )
  }
  return ast
}
