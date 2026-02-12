export function useTracks() {
  function list() {
    return [
      { id: 'track-1', name: 'Treinamento Obrigatório', mandatory: true },
      { id: 'track-2', name: 'Treinamento Complementar', mandatory: false },
    ]
  }

  return { list }
}
