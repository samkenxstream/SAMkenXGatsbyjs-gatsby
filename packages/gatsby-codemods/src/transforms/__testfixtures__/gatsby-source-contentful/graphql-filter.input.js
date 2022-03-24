const result = await graphql(`{
  filterByType: allContentfulPage(filter: {sys: {type: {eq: "someType"}}}) {
    edges {
      node {
        id
      }
    }
  }
  filterById: allContentfulPage(filter: {contentful_id: {eq: null}}) {
    edges {
      node {
        id
      }
    }
  }
  filterAssets: allContentfulAsset(filter: {file: {details: {image: {width: {gt: 2000}}}}}) {
    nodes {
      id
    }
  }
}
`)