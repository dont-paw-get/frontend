import { useMemo } from "react";
import { getTransformMatrix } from "../../lib/perspectiveTransform";

/**
 * useBookWarp – 슬롯 좌표로부터 CSS transform matrix 계산
 * @param {object} corners - { topLeft, topRight, bottomRight, bottomLeft }
 * @param {number} width - 원본 이미지 너비
 * @param {number} height - 원본 이미지 높이
 */
export function useBookWarp(corners, width, height) {
  const matrix = useMemo(() => {
    if (!corners || !width || !height) return null;
    return getTransformMatrix(corners, width, height);
  }, [corners, width, height]);

  return matrix;
}
