import React from "react";
import CreateCustomerModal from "@/components/CreateCustomerModal";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";

export default function Dashboard() {
  const CreateCustomerAny = CreateCustomerModal as any;

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* placeholders */}
      <CreateCustomerAny open={false} />
      <CreateServiceOrderModal open={false} onClose={() => {}} />
    </div>
  );
}
