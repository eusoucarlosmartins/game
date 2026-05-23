// modals.js — utilitários para abrir/fechar modais (sem dependências, evita ciclos)
import { $ } from './util.js';
export function openModal(id) { $(id).classList.remove('hidden'); }
export function closeModal(id) { $(id).classList.add('hidden'); }
