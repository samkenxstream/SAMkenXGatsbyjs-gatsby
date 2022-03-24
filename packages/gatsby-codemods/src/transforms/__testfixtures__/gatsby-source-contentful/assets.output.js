const result = await graphql(`{
  allContentfulAsset {
    edges {
      node {
        sys {
          id
        }
        someOtherField
        url
        fileName
        contentType
        size
        width
        height
      }
    }
  }
}
`)