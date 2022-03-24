const result = await graphql(`{
  allContentfulContentTypePage {
    edges {
      node {
        sys {
          locale
          id
          spaceId
          firstPublishedAt
          publishedAt
          publishedVersion
        }
        someOtherFieldThatIsNotInSys
      }
    }
  }
}
`)

result.allContentfulPage.edges.forEach((node) => {
  const {
    sys: {
      locale: node_locale,
      id: contentful_id,
      spaceId,
      firstPublishedAt: createdAt,
      publishedAt: updatedAt,
      publishedVersion: revision
    }
  } = node
})