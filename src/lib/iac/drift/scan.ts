export interface DriftScanResult {
  summary: {
    total_resources: number;
    total_changed: number;
    total_unmanaged: number;
    total_missing: number;
    total_managed: number;
  };
  managed?: DriftScanManagedResource[];
  unmanaged?: DriftScanUnmanagedResource[];
  missing?: DriftScanUnmanagedResource[];
  differences?: DriftScanDifference[];
  coverage: number;
}

export interface DriftScanManagedResource {
  id: string;
  type: string;
  source: {
    source: string;
    namespace: string;
    internal_name: string;
  };
}

export interface DriftScanUnmanagedResource {
  id: string;
  type: string;
}

export interface DriftScanDifference {
  res: {
    id: string;
    type: string;
  };
  changelog: DriftScanResourceChangelog[];
}

export interface DriftScanResourceChangelog {
  type: string;
  path: string[];
  from: any;
  to: any;
}
