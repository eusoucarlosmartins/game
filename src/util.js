// util.js — pequenos helpers globais sem dependência de estado
export const $ = (id) => document.getElementById(id);
export const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('pt-BR');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const irand = (a, b) => Math.floor(rand(a, b + 1));
