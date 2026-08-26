"use client";

import { Check, Clock, X, Circle, Loader2 } from "lucide-react";

export type PaymentBatchStatus = 'draft' | 'pending_manager' | 'pending_executive_1' | 'pending_finance' | 'pending_executive' | 'ready_to_pay' | 'paid' | 'cancelled';

interface StepperProps {
  status: PaymentBatchStatus;
  activeStepId?: PaymentBatchStatus;
  onClickStep?: (stepId: PaymentBatchStatus) => void;
  submitterName?: string;
  submitDate?: string;
  managerName?: string;
  managerDate?: string;
  executive1Name?: string;
  executive1Date?: string;
  financeName?: string;
  financeDate?: string;
  executiveName?: string;
  executiveDate?: string;
  payerName?: string;
  payDate?: string;
}

export function PaymentStepper({
  status,
  activeStepId,
  onClickStep,
  submitterName,
  submitDate,
  managerName,
  managerDate,
  executive1Name,
  executive1Date,
  financeName,
  financeDate,
  executiveName,
  executiveDate,
  payerName,
  payDate,
}: StepperProps) {
  const steps = [
    {
      id: 'draft',
      label: 'PIC Input',
      actor: submitterName,
      date: submitDate,
      // Completed if status is beyond draft
      isCompleted: status !== 'draft' && status !== 'cancelled',
      isActive: status === 'draft',
      isRejected: status === 'cancelled',
    },
    {
      id: 'pending_manager',
      label: 'Manager Review',
      actor: managerName,
      date: managerDate,
      isCompleted: ['pending_executive_1', 'pending_finance', 'pending_executive', 'ready_to_pay', 'paid'].includes(status),
      isActive: status === 'pending_manager',
      isRejected: false, // If rejected, it usually goes back or cancelled, but batch level rejection might be cancelled
    },
    {
      id: 'pending_executive_1',
      label: 'Executive Review 1',
      actor: executive1Name,
      date: executive1Date,
      isCompleted: ['pending_finance', 'pending_executive', 'ready_to_pay', 'paid'].includes(status),
      isActive: status === 'pending_executive_1',
      isRejected: false,
    },
    {
      id: 'pending_finance',
      label: 'Finance Review',
      actor: financeName,
      date: financeDate,
      isCompleted: ['pending_executive', 'ready_to_pay', 'paid'].includes(status),
      isActive: status === 'pending_finance',
      isRejected: false,
    },
    {
      id: 'pending_executive',
      label: 'Executive Approval',
      actor: executiveName,
      date: executiveDate,
      isCompleted: ['ready_to_pay', 'paid'].includes(status),
      isActive: status === 'pending_executive',
      isRejected: false,
    },
    {
      id: 'ready_to_pay',
      label: 'Siap Bayar',
      actor: payerName,
      date: payDate,
      isCompleted: status === 'paid',
      isActive: status === 'ready_to_pay',
      isRejected: false,
    },
    {
      id: 'paid',
      label: 'Selesai (Paid)',
      actor: null,
      date: null,
      isCompleted: status === 'paid',
      isActive: false,
      isRejected: false,
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-200 z-0"></div>

        {steps.map((step, index) => {
          const isCurrentlyActive = activeStepId ? activeStepId === step.id : step.isActive;
          let circleColor = "bg-slate-100 border-slate-300 text-slate-400";
          let icon = <Circle className="w-4 h-4" />;
          
          if (step.isCompleted) {
            circleColor = "bg-emerald-500 border-emerald-500 text-white";
            icon = <Check className="w-4 h-4" />;
          } else if (step.isRejected) {
            circleColor = "bg-red-500 border-red-500 text-white";
            icon = <X className="w-4 h-4" />;
          } else if (isCurrentlyActive) {
            circleColor = "bg-blue-500 border-blue-500 text-white shadow-sm ring-4 ring-blue-100";
            icon = <Loader2 className="w-4 h-4 animate-spin" />;
          }

          // Line progress
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
              <div 
                onClick={() => onClickStep && onClickStep(step.id as PaymentBatchStatus)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all bg-white ${circleColor} ${onClickStep ? 'cursor-pointer hover:scale-110' : ''}`}
                title={step.label}
              >
                {icon}
              </div>
              <div className="mt-3 text-center">
                <p className={`text-xs font-semibold ${step.isActive ? 'text-blue-700' : step.isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                  {step.label}
                </p>
                {(step.actor || step.date) && (
                  <div className="mt-1">
                    {step.actor && <p className="text-[10px] text-slate-600 font-medium">{step.actor}</p>}
                    {step.date && <p className="text-[10px] text-slate-400">{new Date(step.date).toLocaleDateString('id-ID')}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
