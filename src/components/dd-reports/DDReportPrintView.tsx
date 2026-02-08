import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  getAgencyColor,
  getAgencyDisplayName,
} from '@/lib/violation-utils';

interface DDReportPrintViewProps {
  report: {
    id: string;
    address: string;
    bin: string | null;
    bbl: string | null;
    prepared_for: string;
    prepared_by: string | null;
    report_date: string;
    building_data: any;
    violations_data: any;
    applications_data: any;
    orders_data: any;
    ai_analysis: string | null;
    general_notes: string | null;
  };
}

const DDReportPrintView = ({ report }: DDReportPrintViewProps) => {
  const violations = report.violations_data || [];
  const applications = report.applications_data || [];
  const orders = report.orders_data || { stop_work: [], vacate: [] };
  const building = report.building_data || {};

  return (
    <div className="print-container bg-white text-black p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">Due Diligence Report</h1>
        <h2 className="text-xl mt-2">{report.address}</h2>
        <div className="flex justify-between mt-4 text-sm">
          <div>
            <p><strong>Prepared For:</strong> {report.prepared_for}</p>
            {report.prepared_by && <p><strong>Prepared By:</strong> {report.prepared_by}</p>}
          </div>
          <div className="text-right">
            <p><strong>Report Date:</strong> {format(new Date(report.report_date), 'MMMM d, yyyy')}</p>
            <p><strong>BIN:</strong> {report.bin || '—'} | <strong>BBL:</strong> {report.bbl || '—'}</p>
          </div>
        </div>
      </div>

      {/* Building Information */}
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Building Information</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div><strong>Year Built:</strong> {building.year_built || '—'}</div>
          <div><strong>Stories:</strong> {building.stories || '—'}</div>
          <div><strong>Dwelling Units:</strong> {building.dwelling_units || '—'}</div>
          <div><strong>Building Class:</strong> {building.building_class || '—'}</div>
          <div><strong>Zoning:</strong> {building.zoning_district || '—'}</div>
          <div><strong>Lot Area:</strong> {building.lot_area_sqft ? `${building.lot_area_sqft.toLocaleString()} sqft` : '—'}</div>
          <div><strong>Building Area:</strong> {building.building_area_sqft ? `${building.building_area_sqft.toLocaleString()} sqft` : '—'}</div>
          <div><strong>Landmark:</strong> {building.is_landmark ? 'Yes' : 'No'}</div>
        </div>
        {building.owner_name && (
          <p className="mt-2 text-sm"><strong>Owner:</strong> {building.owner_name}</p>
        )}
      </section>

      {/* Summary Stats */}
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Compliance Summary</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold">{violations.length}</div>
            <div className="text-sm">Open Violations</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold">{applications.length}</div>
            <div className="text-sm">Applications</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold text-red-600">{orders.stop_work?.length || 0}</div>
            <div className="text-sm">Stop Work Orders</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold text-red-600">{orders.vacate?.length || 0}</div>
            <div className="text-sm">Vacate Orders</div>
          </div>
        </div>
      </section>

      {/* Critical Orders */}
      {(orders.stop_work?.length > 0 || orders.vacate?.length > 0) && (
        <section className="mb-6">
          <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3 text-red-600">⚠ Active Orders</h3>
          {orders.stop_work?.map((order: any, idx: number) => (
            <div key={`swo-${idx}`} className="p-3 mb-2 border border-red-300 bg-red-50 rounded">
              <p className="font-bold">Stop Work Order - {order.issued_date}</p>
              <p className="text-sm">{order.description || 'No description available'}</p>
            </div>
          ))}
          {orders.vacate?.map((order: any, idx: number) => (
            <div key={`vacate-${idx}`} className="p-3 mb-2 border border-red-300 bg-red-50 rounded">
              <p className="font-bold">Vacate Order - {order.issued_date}</p>
              <p className="text-sm">{order.description || 'No description available'}</p>
            </div>
          ))}
        </section>
      )}

      {/* AI Analysis */}
      {report.ai_analysis && (
        <section className="mb-6">
          <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Risk Assessment</h3>
          <div className="text-sm whitespace-pre-wrap">{report.ai_analysis}</div>
        </section>
      )}

      {/* Violations Table */}
      <section className="mb-6 page-break-before">
        <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Open Violations ({violations.length})</h3>
        {violations.length === 0 ? (
          <p className="text-sm text-gray-500">No open violations found.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Violation #</th>
                <th className="border p-2 text-left">Agency</th>
                <th className="border p-2 text-left">Type</th>
                <th className="border p-2 text-left">Severity</th>
                <th className="border p-2 text-left">Issued</th>
                <th className="border p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {violations.slice(0, 50).map((v: any, idx: number) => (
                <tr key={idx}>
                  <td className="border p-2 font-mono">{v.violation_number}</td>
                  <td className="border p-2">{v.agency}</td>
                  <td className="border p-2 max-w-[200px] truncate">{v.violation_type || v.description_raw || '—'}</td>
                  <td className="border p-2">{v.severity || '—'}</td>
                  <td className="border p-2">{v.issued_date || '—'}</td>
                  <td className="border p-2">{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {violations.length > 50 && (
          <p className="text-xs text-gray-500 mt-2">Showing first 50 of {violations.length} violations</p>
        )}
      </section>

      {/* Applications Table */}
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Permit Applications ({applications.length})</h3>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-500">No applications found.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Application #</th>
                <th className="border p-2 text-left">Source</th>
                <th className="border p-2 text-left">Type</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Filed</th>
                <th className="border p-2 text-left">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {applications.slice(0, 30).map((app: any, idx: number) => (
                <tr key={idx}>
                  <td className="border p-2 font-mono">{app.application_number}</td>
                  <td className="border p-2">{app.source}</td>
                  <td className="border p-2">{app.application_type || app.job_type || '—'}</td>
                  <td className="border p-2">{app.status || '—'}</td>
                  <td className="border p-2">{app.filing_date || '—'}</td>
                  <td className="border p-2">{app.estimated_cost ? `$${Number(app.estimated_cost).toLocaleString()}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {applications.length > 30 && (
          <p className="text-xs text-gray-500 mt-2">Showing first 30 of {applications.length} applications</p>
        )}
      </section>

      {/* General Notes */}
      {report.general_notes && (
        <section className="mb-6">
          <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{report.general_notes}</p>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        <p>Generated by BuildingIQ • Report ID: {report.id}</p>
        <p>Data sourced from NYC Open Data. This report is for informational purposes only.</p>
      </footer>
    </div>
  );
};

export default DDReportPrintView;
