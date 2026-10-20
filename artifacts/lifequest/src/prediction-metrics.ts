/** Forecast evaluation is only meaningful for values sharing a unit. */
export type ForecastMetric = {estimate:number;actual:number;unit:string};
export function evaluateForecast(input:ForecastMetric):{error:number;absoluteError:number;percentageError:number|null}|null {
 const {estimate,actual,unit}=input;
 if(!Number.isFinite(estimate)||!Number.isFinite(actual)||!unit.trim())return null;
 const error=actual-estimate;
 return {error,absoluteError:Math.abs(error),percentageError:actual===0?null:Math.abs(error/actual)*100};
}
