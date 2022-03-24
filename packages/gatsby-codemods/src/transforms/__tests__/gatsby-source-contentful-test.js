const tests = [
  `assets`,
  `graphql-filter`,
  `graphql-sort`,
  `query-results`,
  `sys`,
  `sys-type`,
]

const defineTest = require(`jscodeshift/dist/testUtils`).defineTest

describe(`codemods`, () => {
  tests.forEach(test =>
    defineTest(
      __dirname,
      `gatsby-source-contentful`,
      null,
      `gatsby-source-contentful/${test}`
    )
  )
})
