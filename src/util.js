// util.js — pequenos helpers globais sem dependência de estado.
// $ retorna `any` deliberadamente: o jogo trata DOM como dinâmico,
// e tipar como HTMLElement|null forçaria centenas de casts redundantes.

/**
 * Atalho para document.getElementById com retorno permissivo.
 * @param {string} id
 * @returns {any}
 */
export const $ = (id) => document.getElementById(id);

/**
 * Formata número como dinheiro em pt-BR.
 * @param {number} n
 * @returns {string}
 */
export const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('pt-BR');

/**
 * Clampa v entre [lo, hi].
 * @param {number} v @param {number} lo @param {number} hi @returns {number}
 */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Aleatório real em [a, b).
 * @param {number} a @param {number} b @returns {number}
 */
export const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Aleatório inteiro em [a, b] (inclusivo nas duas pontas).
 * @param {number} a @param {number} b @returns {number}
 */
export const irand = (a, b) => Math.floor(rand(a, b + 1));
