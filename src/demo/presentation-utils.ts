export function isDemoDebugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1'
}

export function getDestinationFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('destino')
}
