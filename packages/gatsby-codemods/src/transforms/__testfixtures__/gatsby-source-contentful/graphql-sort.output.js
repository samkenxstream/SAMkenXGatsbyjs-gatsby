const result = await graphql(`{
  sortByType: allContentfulContentTypePage(sort: {fields: sys___contentType}) {
    edges {
      node {
        id
      }
    }
  }
  sortById: allContentfulContentTypePage(sort: {fields: sys___id}) {
    edges {
      node {
        id
      }
    }
  }
  sortAssets: allContentfulAsset(sort: {fields: width}) {
    nodes {
      id
    }
  }
}
`)