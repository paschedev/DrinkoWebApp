'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loading } from '@/components/ui/Loading';
import { useStaffRequest } from '@/hooks/useStaffRequest';
import { ApiError } from '@/lib/api';
import type { Category, PanelProduct } from '@/types/panel';

type ProductForm = { name: string; categoryId: string; imageUrl: string; requiresPreparation: boolean };
const emptyForm: ProductForm = { name: '', categoryId: '', imageUrl: '', requiresPreparation: false };

// Catálogo maestro de la productora: de acá salen los productos de cada evento.
export default function PanelCatalogPage() {
  const request = useStaffRequest();
  const [products, setProducts] = useState<PanelProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    request<PanelProduct[]>('/organizer/products').then(setProducts).catch(() => {});
  }, [request]);

  useEffect(() => {
    load();
    request<Category[]>('/organizer/categories').then(setCategories).catch(() => {});
  }, [load, request]);

  async function run(action: () => Promise<unknown>, okText: string) {
    setStatus(null);
    try {
      await action();
      setStatus({ ok: true, text: okText });
      load();
      return true;
    } catch (e) {
      setStatus({ ok: false, text: e instanceof ApiError ? e.message : 'No se pudo guardar' });
      return false;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = {
      name: form.name,
      requiresPreparation: form.requiresPreparation,
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
    };
    const ok = await run(
      () =>
        editingId
          ? request(`/organizer/products/${editingId}`, { method: 'PATCH', body })
          : request('/organizer/products', { method: 'POST', body }),
      editingId ? 'Producto actualizado' : 'Producto creado',
    );
    if (ok) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  function edit(product: PanelProduct) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      categoryId: product.category?.id ?? '',
      imageUrl: product.imageUrl ?? '',
      requiresPreparation: product.requiresPreparation,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(product: PanelProduct) {
    if (!window.confirm(`¿Borrar "${product.name}"?`)) return;
    run(() => request(`/organizer/products/${product.id}`, { method: 'DELETE' }), 'Producto borrado');
  }

  if (!products) {
    return (
      <main className="page">
        <Loading text="Cargando productos..." />
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Productos</h1>
      <form className="card form" onSubmit={submit}>
        <h2>{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
        <label>
          Nombre
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
        </label>
        <label>
          Categoría
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Imagen (URL https, opcional)
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={form.requiresPreparation}
            onChange={(e) => setForm({ ...form, requiresPreparation: e.target.checked })}
          />
          Se prepara en el momento (trago)
        </label>
        <button className="primary">{editingId ? 'Guardar cambios' : 'Crear producto'}</button>
        {editingId && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
          >
            Cancelar edición
          </button>
        )}
        {status && (
          <p className={status.ok ? 'save-status muted' : 'save-status error'}>{status.ok ? `✓ ${status.text}` : status.text}</p>
        )}
      </form>

      <ul className="list">
        {products.map((product) => (
          <li key={product.id} className="row">
            <div>
              <strong>{product.name}</strong>
              <div className="muted">
                {product.category?.name ?? 'Sin categoría'}
                {product.requiresPreparation && ' · se prepara'}
                {product.isArchived && ' · archivado'}
              </div>
              <div className="card-actions">
                <button className="link-button" onClick={() => edit(product)}>
                  Editar
                </button>
                <button
                  className="link-button"
                  onClick={() =>
                    run(
                      () =>
                        request(`/organizer/products/${product.id}`, {
                          method: 'PATCH',
                          body: { isArchived: !product.isArchived },
                        }),
                      product.isArchived ? 'Producto restaurado' : 'Producto archivado',
                    )
                  }
                >
                  {product.isArchived ? 'Restaurar' : 'Archivar'}
                </button>
                <button className="link-button" onClick={() => remove(product)}>
                  Borrar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
