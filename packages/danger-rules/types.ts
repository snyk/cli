import * as danger from 'danger';

export type DangerJS = typeof danger;
export type DangerRule = (dangerjs: DangerJS) => void;
