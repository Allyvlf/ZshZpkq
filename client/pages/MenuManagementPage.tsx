import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChefHat, Edit2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { supabase } from "../lib/supabase";
import { getMenuItems, MenuCategory, MenuItem, saveMenuItems } from "../lib/menuData";
import { getCachedHomeIdentity } from "../lib/homeIdentity";

const emptyForm = {
  name: "",
  description: "",
  description_full: "",
  currency: "USD",
  price: "",
  originalPrice: "",
  category: "mains" as MenuCategory,
  image: "🍽️",
  cookTime: "15-20 min",
  dietary: "",
  calories: "",
  availability: "10",
  maxAvailability: "10",
  origin: "",
  chef_note: "",
  special_offer: "",
  statuses: "",
  isSpecial: false,
};

type FormState = typeof emptyForm;

const MenuManagementPage = () => {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const loadAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthorized(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const cachedRole = getCachedHomeIdentity()?.role;
      const canManage = profile?.role === "manager" || profile?.role === "service_provider" ||
        (!profile?.role &&
          (cachedRole === "manager" || cachedRole === "service_provider"));
      setAuthorized(canManage);
      if (canManage) setItems(getMenuItems());
    };

    loadAccess().catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (authorized === false) navigate("/menu", { replace: true });
  }, [authorized, navigate]);

  if (authorized === null) {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  if (!authorized) return null;

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const editItem = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      description_full: item.description_full,
      currency: item.currency || "USD",
      price: String(item.price),
      originalPrice: String(item.originalPrice),
      category: item.category,
      image: item.image,
      cookTime: item.cookTime,
      dietary: item.dietary.join(", "),
      calories: String(item.calories),
      availability: String(item.availability),
      maxAvailability: String(item.maxAvailability),
      origin: item.origin,
      chef_note: item.chef_note,
      special_offer: item.special_offer || "",
      statuses: item.statuses?.join(", ") || "",
      isSpecial: Boolean(item.special_offer),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveItem = (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(form.price);
    const originalPrice = Number(form.originalPrice) || price;
    const availability = Number(form.availability);
    const maxAvailability = Number(form.maxAvailability);

    if (!form.name.trim() || !form.description.trim() || !price || maxAvailability < 1) return;

    const nextItem: MenuItem = {
      id: editingId || `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      description_full: form.description_full.trim() || form.description.trim(),
      currency: form.currency,
      price,
      originalPrice: Math.max(price, originalPrice),
      category: form.category,
      image: form.image || "🍽️",
      cookTime: form.cookTime,
      difficulty: "medium",
      availability: Math.max(0, availability),
      maxAvailability,
      dietary: form.dietary.split(",").map((value) => value.trim()).filter(Boolean),
      spiceLevel: 0,
      popularity: 0,
      origin: form.origin.trim() || "Sheraton Kitchen",
      calories: Number(form.calories) || 0,
      chef_note: form.chef_note.trim(),
      special_offer: form.isSpecial ? form.special_offer.trim() || "Special offer" : null,
      statuses: form.statuses.split(",").map((value) => value.trim()).filter(Boolean),
      approved: true,
      trending: editingId ? items.find((item) => item.id === editingId)?.trending ?? false : false,
    };

    const nextItems = editingId
      ? items.map((item) => item.id === editingId ? nextItem : item)
      : [...items, nextItem];

    setItems(nextItems);
    saveMenuItems(nextItems);
    resetForm();
  };

  const toggleTrending = (id: string) => {
    const nextItems = items.map((item) => item.id === id ? { ...item, trending: !item.trending } : item);
    setItems(nextItems);
    saveMenuItems(nextItems);
  };

  const toggleVisibility = (id: string) => {
    const nextItems = items.map((item) => item.id === id ? { ...item, approved: !item.approved } : item);
    setItems(nextItems);
    saveMenuItems(nextItems);
  };

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    saveMenuItems(nextItems);
    if (editingId === id) resetForm();
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <button onClick={() => navigate("/staff")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4" /> Back to Staff Portal
            </button>
            <div className="flex items-center gap-3">
              <ChefHat className="h-8 w-8 text-sheraton-gold" />
              <div>
                <h1 className="text-3xl font-bold">Digital Menu Management</h1>
                <p className="text-muted-foreground">Create, update, and publish dishes shown to guests.</p>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/menu")}>View Guest Menu</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {editingId ? "Edit Dish" : "Add Dish"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2"><Label htmlFor="name">Dish name *</Label><Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="currency">Currency</Label><select id="currency" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.currency} onChange={(e) => updateField("currency", e.target.value)}><option value="USD">USD — US Dollar ($)</option><option value="EUR">EUR — Euro (€)</option><option value="GBP">GBP — British Pound (£)</option><option value="CAD">CAD — Canadian Dollar ($)</option><option value="AUD">AUD — Australian Dollar ($)</option><option value="JPY">JPY — Japanese Yen (¥)</option><option value="CHF">CHF — Swiss Franc</option><option value="CNY">CNY — Chinese Yuan (¥)</option><option value="INR">INR — Indian Rupee (₹)</option><option value="ZAR">ZAR — South African Rand</option><option value="AED">AED — UAE Dirham</option><option value="SGD">SGD — Singapore Dollar</option></select></div>
              <div className="space-y-2"><Label htmlFor="price">Current price *</Label><Input id="price" type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => updateField("price", e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="originalPrice">Original price</Label><Input id="originalPrice" type="number" min="0.01" step="0.01" placeholder="Use for discounts" value={form.originalPrice} onChange={(e) => updateField("originalPrice", e.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Short description *</Label><Input id="description" value={form.description} onChange={(e) => updateField("description", e.target.value)} required /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="description_full">Full description</Label><Textarea id="description_full" value={form.description_full} onChange={(e) => updateField("description_full", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="category">Category</Label><select id="category" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.category} onChange={(e) => updateField("category", e.target.value)}><option value="appetizers">Appetizers</option><option value="mains">Main Courses</option><option value="desserts">Desserts</option><option value="beverages">Beverages</option><option value="special">Special Offers</option></select></div>
              <div className="space-y-2"><Label htmlFor="image">Dish icon</Label><select id="image" className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.image} onChange={(e) => updateField("image", e.target.value)}><option value="🍽️">🍽️ General dish</option><option value="🍝">🍝 Pasta</option><option value="🥩">🥩 Steak</option><option value="🦞">🦞 Seafood</option><option value="🍲">🍲 Soup</option><option value="🍕">🍕 Pizza</option><option value="🥗">🥗 Salad</option><option value="🍔">🍔 Burger</option><option value="🍰">🍰 Dessert</option><option value="🍫">🍫 Chocolate</option><option value="🍸">🍸 Cocktail</option><option value="🍉">🍉 Fruit</option><option value="☕">☕ Coffee</option></select></div>
              <div className="space-y-2"><Label htmlFor="cookTime">Preparation time</Label><Input id="cookTime" value={form.cookTime} onChange={(e) => updateField("cookTime", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="origin">Origin</Label><Input id="origin" value={form.origin} onChange={(e) => updateField("origin", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="dietary">Dietary tags</Label><Input id="dietary" placeholder="vegetarian, gluten-free" value={form.dietary} onChange={(e) => updateField("dietary", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="calories">Calories</Label><Input id="calories" type="number" min="0" value={form.calories} onChange={(e) => updateField("calories", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="availability">Available portions</Label><Input id="availability" type="number" min="0" value={form.availability} onChange={(e) => updateField("availability", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="maxAvailability">Maximum portions *</Label><Input id="maxAvailability" type="number" min="1" value={form.maxAvailability} onChange={(e) => updateField("maxAvailability", e.target.value)} required /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="chef_note">Chef note</Label><Input id="chef_note" value={form.chef_note} onChange={(e) => updateField("chef_note", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="statuses">Status labels</Label><Input id="statuses" placeholder="Available, Chef's Pick" value={form.statuses} onChange={(e) => updateField("statuses", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="special_offer">Promotion label</Label><Input id="special_offer" placeholder="20% off, Happy Hour" value={form.special_offer} onChange={(e) => updateField("special_offer", e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.isSpecial} onChange={(e) => setForm((current) => ({ ...current, isSpecial: e.target.checked }))} /> Mark this dish as Special</label>
              <div className="md:col-span-2 flex gap-3"><Button type="submit">{editingId ? "Save Changes" : "Publish Dish"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Published and Draft Dishes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3"><span className="text-3xl">{item.image}</span><div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.category} · {item.currency || "USD"} {item.price.toFixed(2)} · {item.availability}/{item.maxAvailability} available</p></div></div>
                <div className="flex items-center gap-2"><Badge variant={item.approved ? "default" : "outline"}>{item.approved ? "Published" : "Hidden"}</Badge>{item.trending && <Badge className="bg-red-100 text-red-700">Trending</Badge>}<Button size="sm" variant="outline" onClick={() => editItem(item)}><Edit2 className="h-4 w-4 mr-1" /> Edit</Button><Button size="sm" variant="outline" onClick={() => toggleTrending(item.id)}>{item.trending ? "Remove Trending" : "Mark Trending"}</Button><Button size="sm" variant="outline" onClick={() => toggleVisibility(item.id)}>{item.approved ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}{item.approved ? "Hide" : "Publish"}</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MenuManagementPage;
