import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import { loadGraphModel } from '@tensorflow/tfjs-converter'

const LOCAL_MODEL_URL = '/models/movenet-thunder/model.json'

let model = null

export async function initMoveNet() {
  if (model) return model

  await tf.ready()
  console.log('TF.js backend ready:', tf.getBackend())

  model = await loadGraphModel(LOCAL_MODEL_URL)
  console.log('MoveNet loaded from local model')
  return model
}

export async function detectPose(videoElement) {
  if (!model) await initMoveNet()
  if (!videoElement || videoElement.readyState < 2) return null
  if (!videoElement.videoWidth || !videoElement.videoHeight) return null

  const inputSize = 256

  const imgTensor = tf.browser.fromPixels(videoElement)
  const resized = tf.image.resizeBilinear(imgTensor, [inputSize, inputSize])
  const casted = tf.cast(resized, 'int32')
  const expanded = tf.expandDims(casted, 0)

  let output
  try {
    output = model.predict(expanded)
    const data = await output.data()

    tf.dispose([imgTensor, resized, casted, expanded, output])

    const keypoints = []
    for (let i = 0; i < 17; i++) {
      const y = data[i * 3]
      const x = data[i * 3 + 1]
      const score = data[i * 3 + 2]
      keypoints.push({
        x: x * videoElement.videoWidth,
        y: y * videoElement.videoHeight,
        score,
        name: KEYPOINT_NAMES[i],
      })
    }

    return { keypoints }
  } catch (err) {
    tf.dispose([imgTensor, resized, casted, expanded])
    if (output) output.dispose()
    throw err
  }
}

export function cleanup() {
  if (model) {
    model.dispose()
    model = null
  }
}

export const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
]

export const KEYPOINT_MAP = {
  nose: 0, leftEye: 1, rightEye: 2, leftEar: 3, rightEar: 4,
  leftShoulder: 5, rightShoulder: 6, leftElbow: 7, rightElbow: 8,
  leftWrist: 9, rightWrist: 10, leftHip: 11, rightHip: 12,
  leftKnee: 13, rightKnee: 14, leftAnkle: 15, rightAnkle: 16,
}

export const SKELETON_CONNECTIONS = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
  ['leftEye', 'rightEye'],
  ['nose', 'leftEye'],
  ['nose', 'rightEye'],
]
