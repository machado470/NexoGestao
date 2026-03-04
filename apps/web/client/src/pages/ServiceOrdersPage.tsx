import React from "react";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";

export default function ServiceOrdersPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Ordens de Serviço</h1>
      <CreateServiceOrderModal open={false} onClose={() => {}} />
    </div>
  );
}
