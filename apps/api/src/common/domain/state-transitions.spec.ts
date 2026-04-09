import {
  appointmentTransitions,
  ensureTransition,
  serviceOrderTransitions,
} from './state-transitions'

describe('state transitions', () => {
  it('aceita transições válidas de Appointment', () => {
    expect(() =>
      ensureTransition('SCHEDULED', 'CONFIRMED', appointmentTransitions, 'appointment'),
    ).not.toThrow()

    expect(() =>
      ensureTransition('CONFIRMED', 'DONE', appointmentTransitions, 'appointment'),
    ).not.toThrow()
  })

  it('bloqueia transições inválidas de Appointment', () => {
    expect(() =>
      ensureTransition('SCHEDULED', 'DONE', appointmentTransitions, 'appointment'),
    ).toThrow('Transição inválida para appointment')
  })

  it('aceita transições válidas de ServiceOrder', () => {
    expect(() => ensureTransition('OPEN', 'ASSIGNED', serviceOrderTransitions, 'serviceOrder')).not.toThrow()
    expect(() =>
      ensureTransition('IN_PROGRESS', 'DONE', serviceOrderTransitions, 'serviceOrder'),
    ).not.toThrow()
  })

  it('bloqueia transições inválidas de ServiceOrder', () => {
    expect(() => ensureTransition('OPEN', 'DONE', serviceOrderTransitions, 'serviceOrder')).toThrow(
      'Transição inválida para serviceOrder',
    )
  })
})
