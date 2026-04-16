export interface Bar {
  current: number;
  maximum: number;
  increment?: number;
  interval?: number;
  ticktime?: number;
  fulltime?: number;
}

export interface BarsResponse {
  nerve: Bar;
  happy: Bar;
  life: Bar;
  energy: Bar;
  chain?: {
    current: number;
    maximum: number;
    timeout: number;
    modifier: number;
    cooldown: number;
  };
}
