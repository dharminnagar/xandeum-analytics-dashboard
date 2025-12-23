-- CreateTable
CREATE TABLE "system_metrics" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "active_streams" INTEGER NOT NULL,
    "cpu_percent" DECIMAL(10,6) NOT NULL,
    "ram_used" BIGINT NOT NULL,
    "ram_total" BIGINT NOT NULL,
    "packets_received" BIGINT NOT NULL,
    "packets_sent" BIGINT NOT NULL,
    "uptime" INTEGER NOT NULL,
    "current_index" INTEGER NOT NULL,
    "file_size" BIGINT NOT NULL,
    "total_bytes" BIGINT NOT NULL,
    "total_pages" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pods" (
    "id" SERIAL NOT NULL,
    "pubkey" VARCHAR(255),
    "address" VARCHAR(255) NOT NULL,
    "rpc_port" INTEGER,
    "version" VARCHAR(100) NOT NULL,
    "is_public" BOOLEAN,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pod_metrics_history" (
    "id" SERIAL NOT NULL,
    "pod_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "storage_used" BIGINT,
    "storage_committed" BIGINT,
    "storage_usage_percent" DECIMAL(10,6),
    "uptime" INTEGER,
    "last_seen_timestamp" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pod_metrics_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_created_at_idx" ON "system_metrics"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pods_pubkey_key" ON "pods"("pubkey");

-- CreateIndex
CREATE INDEX "pods_pubkey_idx" ON "pods"("pubkey");

-- CreateIndex
CREATE INDEX "pods_address_idx" ON "pods"("address");

-- CreateIndex
CREATE INDEX "pod_metrics_history_pod_id_idx" ON "pod_metrics_history"("pod_id");

-- CreateIndex
CREATE INDEX "pod_metrics_history_timestamp_idx" ON "pod_metrics_history"("timestamp");

-- CreateIndex
CREATE INDEX "pod_metrics_history_created_at_idx" ON "pod_metrics_history"("created_at");

-- AddForeignKey
ALTER TABLE "pod_metrics_history" ADD CONSTRAINT "pod_metrics_history_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
