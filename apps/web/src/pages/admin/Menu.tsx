import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import type { Category, Insumo, Product } from "../../lib/types.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface RecipeDraft {
  insumoId: string;
  quantity: number;
}

const emptyDraft = { id: "", name: "", categoryId: "", price: 0, recipeItems: [] as RecipeDraft[] };

export function Menu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function loadAll() {
    const [cats, ins, prods] = await Promise.all([
      api.get<Category[]>("/categories"),
      api.get<Insumo[]>("/insumos"),
      api.get<Product[]>("/products?all=1"),
    ]);
    setCategories(cats);
    setInsumos(ins);
    setProducts(prods);
  }

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    await api.post("/categories", { name: newCategoryName.trim(), sortOrder: categories.length + 1 });
    setNewCategoryName("");
    await loadAll();
  }

  function startEdit(p?: Product) {
    setError(null);
    if (!p) {
      setDraft({ ...emptyDraft, categoryId: categories[0]?.id ?? "" });
      return;
    }
    setDraft({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      price: p.price,
      recipeItems: p.recipeItems.map((r) => ({ insumoId: r.insumoId, quantity: r.quantity })),
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateRecipeRow(index: number, patch: Partial<RecipeDraft>) {
    setDraft((d) => ({
      ...d,
      recipeItems: d.recipeItems.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  function addRecipeRow() {
    setDraft((d) => ({ ...d, recipeItems: [...d.recipeItems, { insumoId: insumos[0]?.id ?? "", quantity: 1 }] }));
  }

  function removeRecipeRow(index: number) {
    setDraft((d) => ({ ...d, recipeItems: d.recipeItems.filter((_, i) => i !== index) }));
  }

  async function saveProduct() {
    setError(null);
    if (!draft.name.trim() || !draft.categoryId || draft.recipeItems.length === 0) {
      setError("Nombre, categoría y al menos un insumo de receta son obligatorios.");
      return;
    }
    try {
      const payload = {
        name: draft.name.trim(),
        categoryId: draft.categoryId,
        price: draft.price,
        recipeItems: draft.recipeItems,
      };
      if (draft.id) await api.put(`/products/${draft.id}`, payload);
      else await api.post("/products", payload);
      setDraft(emptyDraft);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el producto");
    }
  }

  async function deactivateProduct(id: string) {
    await api.delete(`/products/${id}`);
    await loadAll();
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Menú, recetas y precios</h1>

      <div className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Categorías</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="px-3 py-1 bg-slate-100 rounded-full text-sm">
              {c.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nueva categoría"
            className="flex-1 border rounded-lg p-2 text-sm"
          />
          <button onClick={addCategory} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">
            Agregar
          </button>
        </div>
      </div>

      <div
        ref={formRef}
        className={`bg-white rounded-xl border p-4 space-y-3 scroll-mt-4 ${draft.id ? "ring-2 ring-emerald-500" : ""}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{draft.id ? `Editar producto: ${draft.name}` : "Nuevo producto"}</h2>
          {draft.id && (
            <button onClick={() => startEdit()} className="text-sm underline text-slate-600">
              Empezar producto nuevo
            </button>
          )}
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            placeholder="Nombre"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="border rounded-lg p-2"
          />
          <select
            value={draft.categoryId}
            onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
            className="border rounded-lg p-2"
          >
            <option value="">Selecciona categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Precio"
            value={draft.price || ""}
            onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
            className="border rounded-lg p-2"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Receta (insumos)</div>
          {draft.recipeItems.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={r.insumoId}
                onChange={(e) => updateRecipeRow(i, { insumoId: e.target.value })}
                className="flex-1 border rounded-lg p-2 text-sm"
              >
                {insumos.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name} ({ins.unit.toLowerCase()})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={r.quantity}
                onChange={(e) => updateRecipeRow(i, { quantity: Number(e.target.value) })}
                className="w-24 border rounded-lg p-2 text-sm"
              />
              <button onClick={() => removeRecipeRow(i)} className="text-red-600 text-sm px-2">
                Quitar
              </button>
            </div>
          ))}
          <button onClick={addRecipeRow} className="text-sm text-slate-600 underline">
            + Agregar insumo a la receta
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={saveProduct} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">
            Guardar
          </button>
          {draft.id && (
            <button onClick={() => setDraft(emptyDraft)} className="px-4 py-2 rounded-lg border">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-2">Productos</h2>
        <div className="divide-y">
          {products.map((p) => (
            <div key={p.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className={`font-medium ${!p.active ? "line-through text-slate-400" : ""}`}>{p.name}</div>
                <div className="text-xs text-slate-500">
                  {p.category.name} · {formatCOP(p.price)} ·{" "}
                  {p.recipeItems.map((r) => `${r.quantity}${r.insumo.unit === "ML" ? "ml" : "u"} ${r.insumo.name}`).join(", ")}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(p)} className="text-sm underline">
                  Editar
                </button>
                {p.active && (
                  <button onClick={() => deactivateProduct(p.id)} className="text-sm text-red-600 underline">
                    Desactivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
