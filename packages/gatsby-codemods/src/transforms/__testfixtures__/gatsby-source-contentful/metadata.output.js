const result = await graphql(`{
  allContentfulContentTypePage {
    edges {
      node {
        contentfulMetadata {
          tags {
            id
          }
        }
      }
    }
  }
}
`)

const { tags } = data.contentfulContentTypePage.node.contentfulMetadata