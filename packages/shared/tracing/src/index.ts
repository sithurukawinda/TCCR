import { NodeSDK }                     from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter }               from '@google-cloud/opentelemetry-cloud-trace-exporter';

let sdk: NodeSDK | undefined;

export function initTracing(serviceName: string): void {
  if (sdk) return; // idempotent

  sdk = new NodeSDK({
    serviceName,
    traceExporter:    new TraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}
