export function isPrismaConnectionError(error) {
  if (!error) return false;

  const name = typeof error?.name === "string" ? error.name : "";
  const message = typeof error?.message === "string" ? error.message : "";

  return (
    name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("Error querying the database")
  );
}
