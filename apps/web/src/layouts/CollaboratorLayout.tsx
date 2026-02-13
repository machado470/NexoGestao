import { Outlet } from 'react-router-dom'
import CollaboratorShell from './CollaboratorShell'

export default function CollaboratorLayout() {
  return (
    <CollaboratorShell>
      <Outlet />
    </CollaboratorShell>
  )
}
