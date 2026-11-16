import type { ProductFormValues } from "@/services/owner-products-service";
import { inputClass } from "./DashboardUI";

export function VariantEditor({ form, change, ar, disabled }: { form: ProductFormValues; change: (form: ProductFormValues) => void; ar: boolean; disabled: boolean }) {
  const warn = () => window.confirm(ar ? 'قد تكون هذه الأنواع في سلات العملاء. سيتطلب العملاء اختيارًا جديدًا. متابعة؟' : 'Customers may have these variants in their carts and will need to choose again. Continue?');
  const variants = form.variants;
  return <fieldset disabled={disabled} className="grid min-w-0 gap-3 rounded-xl border border-white/10 p-4">
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={variants.length > 0} onChange={(e) => {
      if (e.target.checked) change({ ...form, variants: [{ name: '', price: '', isAvailable: true }] });
      else if (warn()) change({ ...form, variants: [], price: '', oldPrice: '' });
    }} />{ar ? 'هل المنتج متوفر بأحجام أو أنواع مختلفة؟' : 'Does this product have multiple sizes or variants?'}</label>
    {variants.map((v, index) => <div key={v.id ?? index} className="grid gap-2 border-t border-white/10 pt-3">
      <label>{ar ? 'النوع' : 'Variant'}<input className={inputClass} value={v.name} onChange={(e) => change({ ...form, variants: variants.map((x,i) => i === index ? { ...x, name: e.target.value } : x) })} /></label>
      <label>{ar ? 'السعر' : 'Price'}<input className={inputClass} inputMode="decimal" value={v.price} onChange={(e) => change({ ...form, variants: variants.map((x,i) => i === index ? { ...x, price: e.target.value } : x) })} /></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={v.isAvailable} onChange={(e) => change({ ...form, variants: variants.map((x,i) => i === index ? { ...x, isAvailable: e.target.checked } : x) })} />{ar ? 'متاح' : 'Available'}</label>
      <div className="flex flex-wrap gap-2">{[-1,1].map((delta) => <button type="button" className="min-h-11 px-3 underline" key={delta} disabled={index+delta<0 || index+delta>=variants.length} onClick={() => { const next=[...variants]; [next[index],next[index+delta]]=[next[index+delta],next[index]]; change({...form,variants:next}); }}>{delta<0 ? (ar ? 'لأعلى' : 'Move up') : (ar ? 'لأسفل' : 'Move down')}</button>)}
        <button type="button" className="min-h-11 px-3 underline" onClick={() => { if (!warn()) return; const next=variants.filter((_,i)=>i!==index); change({...form,variants:next,...(!next.length ? {price:'',oldPrice:''} : {})}); }}>{ar ? 'إزالة' : 'Remove'}</button>
      </div>
    </div>)}
    {variants.length>0 && variants.length<20 && <button type="button" className="min-h-11 underline" onClick={()=>change({...form,variants:[...variants,{name:'',price:'',isAvailable:true}]})}>{ar ? 'إضافة نوع' : 'Add variant'}</button>}
  </fieldset>;
}
