export const SWIPE_INTENT = {
  LIKE: "LIKE",
  DISLIKE: "DISLIKE",
  DETAIL: "DETAIL",
} as const;

export type SwipeIntent = (typeof SWIPE_INTENT)[keyof typeof SWIPE_INTENT];

interface SwipeMeasurement {
  offsetX: number;
  offsetY: number;
  velocityX: number;
  velocityY: number;
}

const HORIZONTAL_DISTANCE_THRESHOLD = 104;
const UPWARD_DISTANCE_THRESHOLD = 88;
const FLICK_VELOCITY_THRESHOLD = 650;
const DIRECTION_DOMINANCE = 1.15;

export function resolveSwipeIntent({
  offsetX,
  offsetY,
  velocityX,
  velocityY,
}: SwipeMeasurement): SwipeIntent | null {
  const horizontalDistance = Math.abs(offsetX);
  const verticalDistance = Math.abs(offsetY);
  const isHorizontal =
    horizontalDistance > verticalDistance * DIRECTION_DOMINANCE;
  const isUpward =
    offsetY < 0 && verticalDistance > horizontalDistance * DIRECTION_DOMINANCE;

  if (
    isUpward &&
    (verticalDistance >= UPWARD_DISTANCE_THRESHOLD ||
      velocityY <= -FLICK_VELOCITY_THRESHOLD)
  ) {
    return SWIPE_INTENT.DETAIL;
  }

  if (
    isHorizontal &&
    (horizontalDistance >= HORIZONTAL_DISTANCE_THRESHOLD ||
      Math.abs(velocityX) >= FLICK_VELOCITY_THRESHOLD)
  ) {
    return offsetX > 0 ? SWIPE_INTENT.LIKE : SWIPE_INTENT.DISLIKE;
  }

  return null;
}
