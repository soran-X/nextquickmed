'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, X, Upload } from 'lucide-react';

const EMPTY_FORM = {
  brand_name: '', generic_name: '', description: '',
  price: '', stock: '', requires_rx: false, is_active: true,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .or(search ? `brand_name.ilike.%${search}%,generic_name.ilike.%${search}%` : 'is_active.eq.true,is_active.eq.false')
      .order('brand_name');
    setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImageFiles([]);
    setExistingImages([]);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      brand_name: p.brand_name,
      generic_name: p.generic_name,
      description: p.description ?? '',
      price: String(p.price),
      stock: String(p.stock),
      requires_rx: p.requires_rx,
      is_active: p.is_active,
    });
    setImageFiles([]);
    setExistingImages(p.images ?? []);
    setDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const total = existingImages.length + imageFiles.length + files.length;
    if (total > 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }
    setImageFiles((prev) => [...prev, ...files].slice(0, 3 - existingImages.length));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((i) => i !== url));
  };

  const uploadImages = async (productId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop();
      const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleSave = async () => {
    if (!form.brand_name || !form.generic_name || !form.price || !form.stock) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);

    try {
      const productId = editing?.id ?? crypto.randomUUID();
      const newImageUrls = await uploadImages(productId);
      const allImages = [...existingImages, ...newImageUrls].slice(0, 3);

      const payload = {
        brand_name: form.brand_name,
        generic_name: form.generic_name,
        description: form.description || null,
        price: parseFloat(form.price),
        stock: parseInt(form.stock),
        requires_rx: form.requires_rx,
        is_active: form.is_active,
        images: allImages,
      };

      if (editing) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert({ id: productId, ...payload });
        if (error) throw error;
        toast.success('Product created');
      }

      setDialogOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.brand_name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) toast.error('Failed to delete');
    else { toast.success('Product deleted'); fetchProducts(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Generic Name</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Stock</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">No products found</td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image src={p.images[0]} alt={p.brand_name} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{p.brand_name}</p>
                        {p.requires_rx && <Badge variant="warning" className="text-xs">Rx</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.generic_name}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stock === 0 ? 'text-red-500' : p.stock < 10 ? 'text-yellow-600' : 'text-green-600'}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.is_active ? 'success' : 'secondary'}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}
                        className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Brand Name *</Label>
                <Input className="mt-1" value={form.brand_name}
                  onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
              </div>
              <div>
                <Label>Generic Name *</Label>
                <Input className="mt-1" value={form.generic_name}
                  onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[80px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (₱) *</Label>
                <Input className="mt-1" type="number" min="0" step="0.01"
                  value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Stock *</Label>
                <Input className="mt-1" type="number" min="0"
                  value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>

            {/* Images */}
            <div>
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Product Images (max 3)
              </Label>
              {existingImages.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {existingImages.map((url) => (
                    <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden border">
                      <Image src={url} alt="product" fill className="object-cover" />
                      <button
                        onClick={() => removeExistingImage(url)}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(existingImages.length + imageFiles.length) < 3 && (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className="mt-2 block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700"
                />
              )}
              {imageFiles.length > 0 && (
                <p className="text-xs text-green-600 mt-1">{imageFiles.length} new image(s) selected</p>
              )}
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requires_rx}
                  onChange={(e) => setForm({ ...form, requires_rx: e.target.checked })}
                  className="rounded" />
                <span className="text-sm">Requires Prescription (Rx)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded" />
                <span className="text-sm">Active (visible in store)</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : (editing ? 'Update Product' : 'Create Product')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
