const result = await graphql(`{
  allContentfulPage {
    edges {
      node {
        metadata {
          tags {
            id
          }
        }
      }
    }
  }
}
`)

const { tags } = data.contentfulPage.node.metadata