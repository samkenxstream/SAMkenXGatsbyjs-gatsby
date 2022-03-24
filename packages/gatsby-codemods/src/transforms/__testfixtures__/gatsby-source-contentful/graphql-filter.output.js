const result = await graphql(`{
  filterByType: allContentfulContentTypePage(
    filter: {sys: {contentType: {name: {eq: "someType"}}}}
  ) {
    edges {
      node {
        id
      }
    }
  }
  filterById: allContentfulContentTypePage(filter: {sys: {id: {eq: null}}}) {
    edges {
      node {
        id
      }
    }
  }
  filterAssets: allContentfulAsset(filter: {width: {gt: 2000}}) {
    nodes {
      id
    }
  }
}
`)