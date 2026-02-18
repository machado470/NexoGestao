import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
export default function Onboarding() {
    const navigate = useNavigate();
    async function handleComplete() {
        // conclui onboarding no backend
        await api.post('/onboarding/complete');
        // força revalidação do estado global
        await api.get('/me');
        // agora sim pode ir pro admin
        navigate('/admin');
    }
    return (_jsxs("div", { style: {
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            backgroundColor: '#020617',
            color: 'white',
        }, children: [_jsx("h1", { children: "Onboarding inicial" }), _jsx("p", { children: "Configura\u00E7\u00E3o obrigat\u00F3ria da organiza\u00E7\u00E3o" }), _jsx("button", { onClick: handleComplete, style: {
                    padding: '12px 24px',
                    fontSize: 16,
                    cursor: 'pointer',
                }, children: "Concluir onboarding" })] }));
}
