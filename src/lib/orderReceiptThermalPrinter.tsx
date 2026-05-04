import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { ThermalReceiptData } from "@/lib/thermalReceiptTypes";

// 1. SACAMOS LOS ESTILOS FUERA para evitar re-renders infinitos
const thermalStyles = StyleSheet.create({
    page: {
        padding: 10,
        fontSize: 9,
        fontFamily: 'Helvetica',
        color: '#000',
        backgroundColor: '#FFFFFF',
        width: '226pt', // 80mm
        // Eliminamos el height dinámico por ahora para estabilizar
    },
    header: {
        alignItems: 'center',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderBottomStyle: 'dashed',
        paddingBottom: 10
    },
    labName: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
    labDetails: { fontSize: 7, textAlign: 'center', marginTop: 1 },
    logo: { width: 80, height: 35, marginBottom: 5 },

    title: {
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 5,
    },

    section: {
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderBottomStyle: 'dashed',
        paddingBottom: 5
    },
    infoRow: { flexDirection: 'row', marginBottom: 2 },
    label: { width: '35%', fontSize: 7, fontWeight: 'bold' },
    value: { width: '65%', fontSize: 7 },

    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 2,
        marginBottom: 3,
    },
    tableRow: { flexDirection: 'row', paddingVertical: 2 },
    colName: { width: '70%', fontSize: 8 },
    colPrice: { width: '30%', textAlign: 'right', fontSize: 8 },

    totalSection: {
        marginTop: 5,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: '#000'
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },

    pinBox: {
        marginVertical: 10,
        padding: 5,
        borderWidth: 1,
        borderColor: '#000',
        borderStyle: 'dashed',
        alignItems: 'center'
    },
    footer: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 7,
    },
});

export const OrderThermalReceiptPDF = ({ orderId, orderDate, patientName, patientId, items, total, accessPin, portalUrl, labData, exchangeRate, totalBs }: ThermalReceiptData) => {
    const lab = labData || { name: "LABORATORIO", address: "", phone: "" };

    return (
        <Document>
            {/* 2. LE DAMOS UN SIZE CON ALTO FIJO PARA PRUEBAS */}
            {/* Esto evita que el motor de PDF colapse buscando el final de la página */}
            <Page size={[226, 400]} style={thermalStyles.page}>

                <View style={thermalStyles.header}>
                    <Text style={thermalStyles.labName}>{lab.name}</Text>
                    <Text style={thermalStyles.labDetails}>{lab.address}</Text>
                    <Text style={thermalStyles.labDetails}>{lab.phone}</Text>
                </View>

                <Text style={thermalStyles.title}>NOTA DE ENTREGA</Text>

                <View style={thermalStyles.section}>
                    <View style={thermalStyles.infoRow}>
                        <Text style={thermalStyles.label}>ORDEN:</Text>
                        <Text style={thermalStyles.value}>{orderId.toString().padStart(4, '0')}</Text>
                    </View>
                    <View style={thermalStyles.infoRow}>
                        <Text style={thermalStyles.label}>FECHA:</Text>
                        <Text style={thermalStyles.value}>{orderDate}</Text>
                    </View>
                    <View style={thermalStyles.infoRow}>
                        <Text style={thermalStyles.label}>PACIENTE:</Text>
                        <Text style={thermalStyles.value}>{patientName}</Text>
                    </View>
                </View>

                <View style={thermalStyles.tableHeader}>
                    <Text style={thermalStyles.colName}>EXAMEN</Text>
                    <Text style={thermalStyles.colPrice}>USD</Text>
                </View>

                {items.map((item, index) => (
                    <View key={`${item.test_name}-${index}`} style={thermalStyles.tableRow}>
                        <Text style={thermalStyles.colName}>{item.test_name}</Text>
                        <Text style={thermalStyles.colPrice}>${item.price.toFixed(2)}</Text>
                    </View>
                ))}

                <View style={thermalStyles.totalSection}>
                    <View style={thermalStyles.totalRow}>
                        <Text style={{ fontWeight: 'bold' }}>TOTAL USD:</Text>
                        <Text style={{ fontWeight: 'bold' }}>${total.toFixed(2)}</Text>
                    </View>
                </View>

                {accessPin && (
                    <View style={thermalStyles.pinBox}>
                        <Text style={{ fontSize: 7 }}>PIN ACCESO:</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{accessPin}</Text>
                    </View>
                )}

            </Page>
        </Document>
    );
};
