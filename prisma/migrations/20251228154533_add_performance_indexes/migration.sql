-- CreateIndex
CREATE INDEX "pod_metrics_history_pod_id_timestamp_idx" ON "pod_metrics_history"("pod_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "pod_metrics_history_timestamp_pod_id_idx" ON "pod_metrics_history"("timestamp", "pod_id");
