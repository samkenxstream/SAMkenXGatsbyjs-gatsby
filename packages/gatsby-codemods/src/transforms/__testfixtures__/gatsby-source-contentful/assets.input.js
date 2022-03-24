const result = await graphql(`{
  allContentfulAsset {
    edges {
      node {
        contentful_id
        someOtherField
        file {
          url
          contentType
          fileName
          details {
            size
            image {
              width
              height
            }
          }
        }
      }
    }
  }
}
`)