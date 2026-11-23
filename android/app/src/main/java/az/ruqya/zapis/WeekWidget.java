package az.ruqya.zapis;

/** Owner 23.11: «həftəlik» widget — seven days, Monday first, the names of each day (‹ › another week). */
public class WeekWidget extends AgendaWidget {
    static final String ACTION_PREV = "az.ruqya.zapis.WEEK_PREV";
    static final String ACTION_NEXT = "az.ruqya.zapis.WEEK_NEXT";

    @Override
    boolean week() {
        return true;
    }

    @Override
    String prevAction() {
        return ACTION_PREV;
    }

    @Override
    String nextAction() {
        return ACTION_NEXT;
    }

    @Override
    Class<?> self() {
        return WeekWidget.class;
    }
}
