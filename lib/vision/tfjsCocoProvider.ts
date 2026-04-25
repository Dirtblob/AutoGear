import { createDetectedObject, type ObjectDetectionProvider } from "./objectDetectionProvider";
import type { DetectedObject } from "./types";

interface CocoSsdPrediction {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface CocoSsdModel {
  detect(
    image: HTMLCanvasElement | HTMLVideoElement,
    maxNumBoxes?: number,
    minScore?: number,
  ): Promise<CocoSsdPrediction[]>;
}

export class TfjsCocoProvider implements ObjectDetectionProvider {
  name = "tfjs-coco-ssd";

  private model: CocoSsdModel | null = null;

  async load(): Promise<void> {
    if (this.model) return;

    const tf = await import("@tensorflow/tfjs");
    await Promise.all([import("@tensorflow/tfjs-backend-webgl"), import("@tensorflow/tfjs-backend-cpu")]);

    try {
      await tf.setBackend("webgl");
    } catch {
      await tf.setBackend("cpu");
    }

    await tf.ready();

    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    this.model = (await cocoSsd.load({
      base: "lite_mobilenet_v2",
    })) as CocoSsdModel;
  }

  async detect(image: HTMLCanvasElement | HTMLVideoElement): Promise<DetectedObject[]> {
    if (!this.model) {
      throw new Error("The COCO-SSD model is not loaded yet.");
    }

    const predictions = await this.model.detect(image, 20, 0.4);
    return predictions.map((prediction) =>
      createDetectedObject(prediction.class, prediction.score, {
        x: prediction.bbox[0],
        y: prediction.bbox[1],
        width: prediction.bbox[2],
        height: prediction.bbox[3],
      }),
    );
  }
}
