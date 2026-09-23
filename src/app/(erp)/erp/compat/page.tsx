import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CompatAdmin } from "@/sections/compat/CompatAdmin";

export default async function CompatAdminPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: pts }, { data: models }, { data: groups }, { data: members }, { data: items }] =
    await Promise.all([
      sb.from("part_types").select("id,name,emoji,sort").order("sort"),
      sb.from("phone_models").select("id,brand,name"),
      sb.from("compat_groups").select("id,part_type_id,item_id,note"),
      sb.from("compat_members").select("group_id,model_id"),
      sb.from("items").select("id,name,pr,stock").order("name"),
    ]);
  const memByG = new Map<string, string[]>();
  (members ?? []).forEach((m: any) => {
    const arr = memByG.get(m.group_id) ?? []; arr.push(m.model_id); memByG.set(m.group_id, arr);
  });
  const G = (groups ?? []).map((g: any) => ({
    id: g.id, ptId: g.part_type_id,
    modelIds: memByG.get(g.id) ?? [], note: g.note, itemId: g.item_id,
  }));
  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Part Compatibility</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          One group = one physical part that fits all listed models. Shown on the public
          landing-page compatibility checker.</p>
      </div>
      <CompatAdmin partTypes={(pts ?? []) as any} models={(models ?? []) as any}
        groups={G as any} items={(items ?? []) as any} />
    </>
  );
}