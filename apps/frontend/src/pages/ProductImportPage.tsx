import React, { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '../lib/apiClient';

interface ImportReport {
    successCount: number;
    failCount: number;
    errors: { row: number; sku: string; error: string }[];
}

interface uploadedFile {
    name: string;
    type: string;
    size: number;
}

function humaniseImportError(raw: string): string {
    if (!raw) return 'Something went wrong with this row.';
    const s = raw.toLowerCase();
    if (s.includes('costprice') && s.includes('number'))
        return 'The "Buying Price" column has letters instead of numbers.';
    if (s.includes('selling') && s.includes('price') && s.includes('number'))
        return 'The "Selling Price" column has letters instead of numbers.';
    if (s.includes('selling') && s.includes('price') && (s.includes('required') || s.includes('missing') || s.includes('invalid')))
        return 'The "Selling Price" column is empty or invalid — this field is required.';
    if (s.includes('productname') && (s.includes('required') || s.includes('missing')))
        return 'The "Product Name" column is empty — every product must have a name.';
    if (s.includes('stock') && s.includes('number'))
        return 'The "Stock" column has letters instead of a number.';
    if (s.includes('duplicate') || s.includes('already exists'))
        return 'This product already exists — it will be skipped.';
    if (s.includes('category') && s.includes('not found'))
        return 'The category name in this row was not found. Create the category first in ADINO POS.';
    return raw;
}

export const ProductImportPage = () => {
    const { user, token } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<ImportReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const uploadedFile: File = e.target.files[0]!;
            if (uploadedFile.type !== 'text/csv' && !uploadedFile.name.endsWith('.csv')) {
                setError('Invalid file type. Please upload a CSV file.');
                setFile(null);
                return;
            }
            setFile(uploadedFile);
            setReport(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !user) {
            setError("Please select a file to upload.");
            return;
        }

        setLoading(true);
        setReport(null);
        setError(null);

        try {
            const response = await apiClient.uploadProducts(file, user.tenantId, token!);
            console.log('Import response:', response);
            setError(response.report.error || null);
            setReport(response.report);

            // Only clear the file if import was fully successful
            if (response.report.failCount === 0) {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during import.');
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-gray-900">
                Bulk Product Import
            </h1>
            <p className="text-gray-500">
                Upload a CSV file to create or update multiple products instantly.
            </p>

            <Card className="p-6 space-y-4">
                <h2 className="text-xl font-semibold mb-2 flex items-center">
                    <Upload className="w-5 h-5 mr-2" /> Upload CSV File
                </h2>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                            {file ? `Selected: ${file.name}` : "Click or drag a CSV file here"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Must be a CSV file.
                            {/* --- MODIFIED LINK --- */}
                            <a
                                href="/templates/Adino_POS_Product_Import_Template.csv"
                                download="Adino_POS_Product_Import_Template.csv"
                                type="text/csv"
                                className="text-blue-500 hover:underline font-medium ml-1"
                            >
                                Download example file (with sample Nigerian products)
                            </a>.
                        </p>
                    </label>
                </div>

                <Button
                    onClick={handleUpload}
                    disabled={!file || loading}
                    className="w-full h-12 bg-[#D4AF37] hover:bg-[#C2A133] text-white"
                >
                    {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
                    {loading ? "Processing..." : `Import ${file ? file.name : 'Products'}`}
                </Button>

                {error && (
                    <div className="flex items-center p-3 bg-red-100 text-red-700 rounded-md">
                        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
                    </div>
                )}
            </Card>

            {/* Import Report Display */}
            {report && (
                <Card className="p-6 space-y-4">
                    <h2 className="text-xl font-semibold flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-green-600" /> Import Summary
                    </h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-green-50 rounded-md">
                            <p className="text-sm font-medium text-gray-600">Successful</p>
                            <p className="text-2xl font-bold text-green-600">{report.successCount}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-md">
                            <p className="text-sm font-medium text-gray-600">Failed</p>
                            <p className="text-2xl font-bold text-red-600">{report.failCount}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-md">
                            <p className="text-sm font-medium text-gray-600">Total Rows</p>
                            <p className="text-2xl font-bold text-blue-600">{report.successCount + report.failCount}</p>
                        </div>
                    </div>

                    {report.errors.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="text-lg font-semibold text-red-700 mb-2 flex items-center">
                                <X className="w-4 h-4 mr-1" /> Import Errors ({report.errors.length})
                            </h3>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {report.errors.map((err, index) => (
                                    <div key={index} className="p-2 text-sm bg-red-50 border-l-4 border-red-400">
                                        <p>
                                            <strong>Row {err.row}:</strong> {humaniseImportError(err.error)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};