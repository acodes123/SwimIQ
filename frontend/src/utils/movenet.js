import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import { loadGraphModel } from '@tensorflow/tfjs-converter'
import { KEYPOINT_NAMES, KEYPOINT_MAP, SKELETON_CONNECTIONS } from './keypoints'

export { KEYPOINT_NAMES, KEYPOINT_MAP, SKELETON_CONNECTIONS }

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

