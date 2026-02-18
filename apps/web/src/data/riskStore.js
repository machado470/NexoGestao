let people = [
    { name: 'Carlos Almeida', risk: 'Alto', level: 90, pendingTracks: 2 },
    { name: 'Fernanda Souza', risk: 'Médio', level: 65, pendingTracks: 1 },
    { name: 'João Pereira', risk: 'Alto', level: 88, pendingTracks: 2 },
];
export function getPeople() {
    return people;
}
export function assignCorrectiveAction(name) {
    people = people.map(p => p.name === name
        ? { ...p, risk: 'Monitoramento' }
        : p);
}
