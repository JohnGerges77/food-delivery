export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6 text-sm text-zinc-600">
      {message}
    </div>
  );
}
