const result = await graphql(`{
  allContentfulPage {
    edges {
      node {
        sys {
          type
        }
      }
    }
  }
}
`)

result.allContentfulPage.edges.forEach((node) => {
  const {
    sys: { type }
  } = node
})