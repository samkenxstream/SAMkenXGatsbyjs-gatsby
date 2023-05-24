import { Step } from "./../../utils/run-steps"
import fetchAndApplyNodeUpdates from "./update-nodes/fetch-node-updates"

import { fetchAndCreateAllNodes } from "./fetch-nodes/fetch-nodes"

import { LAST_COMPLETED_SOURCE_TIME } from "~/constants"
import store from "~/store"
import fetchAndCreateNonNodeRootFields from "./create-nodes/fetch-and-create-non-node-root-fields"
import { allowFileDownloaderProgressBarToClear } from "./create-nodes/create-remote-file-node/progress-bar-promise"
import { sourcePreviews } from "~/steps/preview"
import { hasStatefulSourceNodes } from "~/utils/gatsby-features"

const sourceNodes: Step = async helpers => {
  const { cache, webhookBody, refetchAll, actions } = helpers

  if (hasStatefulSourceNodes) {
    actions.enableStatefulSourceNodes()
  }

  // fetch non-node root fields such as settings.
  // For now, we're refetching them on every build
  const nonNodeRootFieldsPromise = fetchAndCreateNonNodeRootFields()

  // if this is a preview we want to process it and return early
  if (webhookBody.token && webhookBody.userDatabaseId) {
    await sourcePreviews(helpers)
    await nonNodeRootFieldsPromise
    return
  }

  const now = Date.now()

  const lastCompletedSourceTime =
    webhookBody.refreshing && webhookBody.since
      ? webhookBody.since
      : await cache.get(LAST_COMPLETED_SOURCE_TIME)

  const { schemaWasChanged, foundUsableHardCachedData } =
    store.getState().remoteSchema

  const fetchEverything =
    foundUsableHardCachedData ||
    !lastCompletedSourceTime ||
    refetchAll ||
    // don't refetch everything in development
    (process.env.NODE_ENV !== `development` &&
      // and the schema was changed
      schemaWasChanged)

  // If this is an uncached build,
  // or our initial build to fetch and cache everything didn't complete,
  // pull everything from WPGQL
  if (fetchEverything) {
    await fetchAndCreateAllNodes()
  }

  // If we've already successfully pulled everything from WPGraphQL
  // just pull the latest changes
  else if (!fetchEverything) {
    await fetchAndApplyNodeUpdates({
      since: lastCompletedSourceTime,
    })
  }

  await nonNodeRootFieldsPromise

  allowFileDownloaderProgressBarToClear()
  await helpers.cache.set(LAST_COMPLETED_SOURCE_TIME, now)

  const { dispatch } = store
  dispatch.remoteSchema.setSchemaWasChanged(false)
  dispatch.develop.resumeRefreshPolling()
}

export { sourceNodes }
