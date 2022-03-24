const result = await graphql(`{
  allContentfulPage {
    edges {
      node {
        node_locale
        contentful_id
        spaceId
        someOtherFieldThatIsNotInSys
        createdAt
        updatedAt
        revision
      }
    }
  }
}
`)

result.allContentfulPage.edges.forEach((node) => {
  const {
    node_locale,
    contentful_id,
    spaceId,
    createdAt,
    updatedAt,
    revision,
  } = node
})

const importantCheck = !!customResult.node.contentful_id
const testLocale = data.contentfulPage.node.node_locale