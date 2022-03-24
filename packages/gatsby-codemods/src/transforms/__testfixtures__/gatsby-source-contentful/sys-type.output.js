const result = await graphql(`{
  allContentfulContentTypePage {
    edges {
      node {
        sys {
          contentType
        }
      }
    }
  }
}
`)

result.allContentfulPage.edges.forEach((node) => {
  const {
    sys: { contentType }
  } = node
})