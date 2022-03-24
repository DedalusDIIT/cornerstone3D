import { triggerEvent, eventTarget } from '@cornerstonejs/core'

import { Events } from '../../enums'
import {
  getToolGroupsWithSegmentation,
  getToolGroups,
  getGlobalSegmentationState,
} from '../../stateManagement/segmentation/segmentationState'
import {
  SegmentationStateModifiedEventDetail,
  SegmentationDataModifiedEventDetail,
  SegmentationGlobalStateModifiedEventDetail,
} from '../../types/EventTypes'

/**
 * Trigger an event on the eventTarget that the segmentation state for
 * toolGroupUID has been updated
 * @param toolGroupUID - The UID of the toolGroup
 */
function triggerSegmentationStateModified(toolGroupUID: string): void {
  const eventDetail: SegmentationStateModifiedEventDetail = {
    toolGroupUID,
  }

  triggerEvent(eventTarget, Events.SEGMENTATION_STATE_MODIFIED, eventDetail)
}

/**
 * Triggers segmentation global state updated event, notifying all toolGroups
 * that the global state has been updated, If a segmentationUID is provided
 * the event will only be triggered for that segmentation, otherwise it will
 * be triggered for all segmentations.
 *
 * @param segmentationUID - The UID of the segmentation that has been updated
 */
function triggerSegmentationGlobalStateModified(
  segmentationUID?: string
): void {
  let toolGroupUIDs, segmentationUIDs

  if (segmentationUID) {
    toolGroupUIDs = getToolGroupsWithSegmentation(segmentationUID)
    segmentationUIDs = [segmentationUID]
  } else {
    // get all toolGroups
    toolGroupUIDs = getToolGroups()
    segmentationUIDs = getGlobalSegmentationState().map(
      ({ volumeUID }) => volumeUID
    )
  }

  // 1. Trigger an event notifying all listeners about the segmentationUID
  // that has been updated.
  segmentationUIDs.forEach((segmentationUID) => {
    const eventDetail: SegmentationGlobalStateModifiedEventDetail = {
      segmentationUID,
    }
    triggerEvent(
      eventTarget,
      Events.SEGMENTATION_GLOBAL_STATE_MODIFIED,
      eventDetail
    )
  })

  // 2. Notify all viewports that render the segmentationUID in order to update the
  // rendering based on the new global state.
  toolGroupUIDs.forEach((toolGroupUID) => {
    triggerSegmentationStateModified(toolGroupUID)
  })
}

/**
 * Trigger an event that a segmentation data has been modified
 * @param toolGroupUID - The UID of the tool group that triggered the event.
 * @param segmentationDataUID - The UID of the segmentation data that was modified.
 */
function triggerSegmentationDataModified(
  toolGroupUID: string,
  segmentationDataUID: string
): void {
  const eventDetail: SegmentationDataModifiedEventDetail = {
    toolGroupUID,
    segmentationDataUID,
  }

  triggerEvent(eventTarget, Events.SEGMENTATION_DATA_MODIFIED, eventDetail)
}

export {
  // ToolGroup Specific
  triggerSegmentationStateModified,
  // Global
  triggerSegmentationDataModified,
  triggerSegmentationGlobalStateModified,
}