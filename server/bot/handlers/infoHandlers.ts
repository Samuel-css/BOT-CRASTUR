/**
 * @file infoHandlers.ts
 * @description BARRIL de respuestas informativas del negocio. La implementación está
 * dividida por temática en `handlers/info/`:
 *   - paymentHandlers.ts    → pagos, Binance, tasa BCV, descuentos, medios no aceptados.
 *   - logisticsHandlers.ts  → delivery, envíos nacionales, retiro, referencias y horario.
 *   - storeInfoHandlers.ts  → calidad, garantía, categorías, precios, mayoreo, redes.
 *   - supportHandlers.ts    → atención a personas mayores y manejo de quejas.
 *
 * Se conserva esta fachada para no cambiar los imports existentes en el router.
 */

export {
  handlePaymentMethodsResponse,
  handleDiscountResponse,
  handleRateQueryResponse,
  handleBinancePaymentResponse,
  handleNonAcceptedPaymentsResponse
} from './info/paymentHandlers';

export {
  handleDeliveryResponse,
  handleNationalShippingResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleStoreHoursResponse,
  handleLocationResponse
} from './info/logisticsHandlers';

export {
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleMotoQueryResponse,
  handleCaucheraQueryResponse,
  handleSocialResponse,
  handleInvoicingQueryResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleHowToBuyResponse,
  handleCarInquiryResponse,
  handleCategoryBrowseResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse
} from './info/storeInfoHandlers';

export {
  handleElderlyOrConfusedResponse,
  handleHostilityOrComplaintResponse
} from './info/supportHandlers';

import {
  handlePaymentMethodsResponse,
  handleDiscountResponse,
  handleRateQueryResponse,
  handleBinancePaymentResponse,
  handleNonAcceptedPaymentsResponse
} from './info/paymentHandlers';
import {
  handleDeliveryResponse,
  handleNationalShippingResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleStoreHoursResponse,
  handleLocationResponse
} from './info/logisticsHandlers';
import {
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleMotoQueryResponse,
  handleCaucheraQueryResponse,
  handleSocialResponse,
  handleInvoicingQueryResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleHowToBuyResponse,
  handleCarInquiryResponse,
  handleCategoryBrowseResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse
} from './info/storeInfoHandlers';
import {
  handleElderlyOrConfusedResponse,
  handleHostilityOrComplaintResponse
} from './info/supportHandlers';

export default {
  handlePaymentMethodsResponse,
  handleDiscountResponse,
  handleRateQueryResponse,
  handleBinancePaymentResponse,
  handleNonAcceptedPaymentsResponse,
  handleDeliveryResponse,
  handleNationalShippingResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleStoreHoursResponse,
  handleLocationResponse,
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleMotoQueryResponse,
  handleCaucheraQueryResponse,
  handleSocialResponse,
  handleInvoicingQueryResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleHowToBuyResponse,
  handleCarInquiryResponse,
  handleCategoryBrowseResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse,
  handleElderlyOrConfusedResponse,
  handleHostilityOrComplaintResponse
};
