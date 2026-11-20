export async function HEAD() {
  return new Response(null);
}

export const OPTIONS = async () => new Response(null);
