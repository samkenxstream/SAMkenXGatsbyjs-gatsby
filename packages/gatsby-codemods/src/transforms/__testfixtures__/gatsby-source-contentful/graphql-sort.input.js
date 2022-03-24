const result = await graphql(`{
  sortByType: allContentfulPage(sort: {fields: sys___type}) {
    edges {
      node {
        id
      }
    }
  }
  sortById: allContentfulPage(sort: {fields: contentful_id}) {
    edges {
      node {
        id
      }
    }
  }
  sortAssets: allContentfulAsset(sort: {fields: file___details___image___width}) {
    nodes {
      id
    }
  }
}
`)